export interface SchemaField {
  name: string;
  type: string;
  enumValues?: string[];
  description?: string;
  isPrimary?: boolean;
  isNested?: boolean;
  parentField?: string;
}

export interface SchemaEntity {
  name: string;
  path?: string;
  storageType: 'file' | 'json' | 'table';
  managedBy?: string;
  notes: string[];
  fields: SchemaField[];
}

export interface SchemaRelation {
  from: string;
  fromField: string;
  to: string;
  toField: string;
  cardinality: '1:1' | '1:N';
}

export interface ParsedSchema {
  entities: SchemaEntity[];
  relations: SchemaRelation[];
}

const SQL_TYPES = new Set([
  'text', 'int', 'integer', 'numeric', 'boolean', 'timestamp',
  'jsonb', 'json', 'serial', 'bigint', 'smallint', 'real',
  'double', 'float', 'date', 'time', 'uuid', 'bytea', 'blob',
  'varchar', 'char', 'array',
]);

function isSqlType(raw: string): boolean {
  const base = raw.replace(/\(.*\)/, '').replace(/\[.*\]/, '').toLowerCase();
  return SQL_TYPES.has(base);
}

/**
 * Parse SQL content into schema representation.
 * Handles standard CREATE TABLE with inline comments for JSONB sub-fields,
 * plus standalone comment-based schema docs.
 */
export function parseSqlContent(content: string): ParsedSchema {
  const { entities: sqlEntities, relations: sqlRelations } = parseCreateTables(content);
  const commentEntities = parseCommentSchemas(content);

  const seen = new Set(sqlEntities.map(e => e.name.toLowerCase()));
  const entities = [
    ...sqlEntities,
    ...commentEntities.filter(e => !seen.has(e.name.toLowerCase())),
  ];

  const heuristicRelations = extractRelations(entities);
  const relKey = (r: SchemaRelation) => `${r.from}.${r.fromField}->${r.to}.${r.toField}`;
  const sqlRelKeys = new Set(sqlRelations.map(relKey));
  const relations = [
    ...sqlRelations,
    ...heuristicRelations.filter(r => !sqlRelKeys.has(relKey(r))),
  ];

  return { entities, relations };
}

// ── SQL CREATE TABLE (line-by-line) ──

function parseCreateTables(content: string): { entities: SchemaEntity[]; relations: SchemaRelation[] } {
  const entities: SchemaEntity[] = [];
  const relations: SchemaRelation[] = [];
  const lines = content.split('\n');

  let currentName: string | null = null;
  let currentFields: SchemaField[] = [];
  let currentPath: string | undefined;
  let inBody = false;
  let lastTopParent: string | null = null;

  function flush() {
    if (currentName && currentFields.length > 0) {
      entities.push({ name: currentName, path: currentPath, fields: currentFields, storageType: 'table', notes: [] });
    }
    currentName = null;
    currentPath = undefined;
    currentFields = [];
    inBody = false;
    lastTopParent = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Extract Firestore path from section header: "-- N. NAME -- /collection/{id}"
    if (/^\s*--\s*\d+\.\s+\w+/.test(raw)) {
      const pathMatch = raw.match(/\/\w+\/\{[^}]+\}/);
      if (pathMatch) currentPath = pathMatch[0];
      continue;
    }

    // CREATE TABLE start
    const createMatch = trimmed.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(/i);
    if (createMatch) {
      flush();
      currentName = createMatch[1];
      currentFields = [];
      inBody = true;
      continue;
    }

    if (!inBody || !currentName) continue;

    // End of CREATE TABLE
    if (/^\s*\)\s*;/.test(raw)) {
      flush();
      continue;
    }

    // Comment lines inside CREATE TABLE body
    if (/^\s*--/.test(raw)) {
      const commentText = raw.replace(/^\s*--\s?/, '');
      const ct = commentText.trim();

      // Skip decorative separators, empty comments
      if (!ct || /^[═─=\-*]{3,}/.test(ct)) continue;
      // Skip prose comments (lines starting with uppercase words that aren't field patterns)
      // but DO parse field patterns

      // Sub-sub-field with leading dot: ".notifications.payment BOOLEAN -- Default: true"
      // These belong to the last seen top-level parent
      if (ct.startsWith('.')) {
        const dotMatch = ct.match(/^\.(\w+(?:\.\w+)*)\s+(\w+(?:(?:\([^)]*\))|(?:\[[\w,\s]*\]))?)\s*(.*)/i);
        if (dotMatch && isSqlType(dotMatch[2]) && lastTopParent) {
          const subPath = dotMatch[1];
          const fieldType = dotMatch[2].toLowerCase();
          const rest = dotMatch[3] || '';
          const descMatch = rest.match(/--\s*(.+)$/);
          const description = descMatch ? descMatch[1].trim() : undefined;
          currentFields.push({
            name: `${lastTopParent}.${subPath}`,
            type: fieldType,
            description,
            isNested: true,
            parentField: lastTopParent,
          });
        }
        continue;
      }

      // Standard nested field: "parent.field TYPE" or "parent[].field TYPE"
      const sfMatch = ct.match(
        /^(\w+(?:\[\])?)\.(\w+(?:\.\w+)*)\s+(\w+(?:(?:\([^)]*\))|(?:\[[\w,\s]*\]))?)\s*(.*)/i
      );
      if (sfMatch && isSqlType(sfMatch[3])) {
        const parentField = sfMatch[1].replace(/\[\]$/, '');
        const subPath = sfMatch[2];
        const fieldType = sfMatch[3].toLowerCase();
        const rest = sfMatch[4] || '';
        const descMatch = rest.match(/--\s*(.+)$/);
        const description = descMatch ? descMatch[1].trim() : undefined;

        lastTopParent = parentField;
        currentFields.push({
          name: `${parentField}.${subPath}`,
          type: fieldType,
          description,
          isNested: true,
          parentField,
        });
        continue;
      }

      // Not a field pattern, skip
      continue;
    }

    // Skip empty lines
    if (!trimmed) continue;

    // Strip inline comment for column parsing
    const codePart = trimmed.replace(/--.*$/, '').trim();
    const cleaned = codePart.replace(/,\s*$/, '').trim();

    // Skip constraint lines
    if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX)\b/i.test(cleaned)) continue;

    // Column definition: name TYPE [constraints...]
    const colMatch = cleaned.match(
      /^[`"']?(\w+)[`"']?\s+(\w+(?:(?:\([^)]*\))|(?:\[[\w,\s]*\]))?)\s*(.*)/i
    );
    if (!colMatch) continue;

    const fieldName = colMatch[1];
    const rawType = colMatch[2];
    const rest = colMatch[3] || '';

    if (!isSqlType(rawType)) continue;

    const fieldType = rawType.toLowerCase();
    const isPrimary = /PRIMARY\s+KEY/i.test(rest);

    // Extract REFERENCES for FK relationships
    const refMatch = rest.match(/REFERENCES\s+[`"']?(\w+)[`"']?\s*\(\s*[`"']?(\w+)[`"']?\s*\)/i);
    if (refMatch) {
      relations.push({
        from: currentName,
        fromField: fieldName,
        to: refMatch[1],
        toField: refMatch[2],
        cardinality: '1:1',
      });
    }

    // Inline comment as description
    const inlineDesc = raw.match(/--\s*(.+)$/);
    const description = inlineDesc ? inlineDesc[1].trim() : undefined;

    // Track parent for JSONB fields (upcoming nested comments reference this)
    if (fieldType === 'jsonb' || fieldType === 'json') {
      lastTopParent = fieldName;
    }

    currentFields.push({
      name: fieldName,
      type: fieldType,
      isPrimary,
      description,
    });
  }

  flush();
  return { entities, relations };
}

// ── Comment-based schema parser (for non-SQL schema docs) ──

function parseCommentSchemas(content: string): SchemaEntity[] {
  const entities: SchemaEntity[] = [];
  let current: SchemaEntity | null = null;
  let collectingFields = false;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const commentMatch = raw.match(/^--\s?(.*)/);
    if (!commentMatch) continue;
    const line = commentMatch[1].trim();

    // Section separator
    if (/^={4,}$/.test(line)) {
      if (current && current.fields.length > 0) entities.push(current);
      current = null;
      collectingFields = false;
      continue;
    }

    // Skip section category headers like "FILE SCHEMAS (markdown with YAML frontmatter)"
    if (/^[A-Z ]+\(/.test(line) && !line.match(/^[a-z_]/)) continue;

    // Entity header: "ENTITY NAME: path"
    const entityMatch = line.match(/^([A-Z][A-Z _]+?):\s+(\S.+)$/);
    if (entityMatch && !collectingFields) {
      const candidateName = entityMatch[1].trim();
      if (candidateName === candidateName.toUpperCase() && candidateName.length > 1) {
        if (current && current.fields.length > 0) entities.push(current);
        const pathStr = entityMatch[2].trim();
        current = {
          name: candidateName,
          path: pathStr,
          storageType: pathStr.endsWith('.json') ? 'json' : 'file',
          notes: [],
          fields: [],
        };
        collectingFields = false;
        continue;
      }
    }

    // Managed/Created by
    if (current) {
      const managedMatch = line.match(/^(?:Created|Managed)\s+by:\s+(.+)/i);
      if (managedMatch) {
        current.managedBy = managedMatch[1].trim();
        continue;
      }
    }

    // Start field collection
    if (line.includes('Fields in YAML frontmatter') || line.startsWith('Schema ')) {
      collectingFields = true;
      continue;
    }
    if (line === '[' || line === '{') { collectingFields = true; continue; }
    if (line === ']' || line === '}' || line === '...' || line === '},') continue;

    // Parse fields
    if (current && collectingFields) {
      // YAML style: field_name: value  -- description
      const yamlMatch = line.match(/^([a-z_]\w*):\s+(.+?)(?:\s{2,}--\s+(.+))?$/);
      if (yamlMatch) {
        const { type, enumValues } = inferType(yamlMatch[2].trim(), yamlMatch[3]?.trim());
        current.fields.push({
          name: yamlMatch[1],
          type,
          enumValues,
          description: yamlMatch[3]?.trim(),
          isPrimary: yamlMatch[1] === 'id',
        });
        continue;
      }

      // JSON style: "field": value,  -- description
      const jsonMatch = line.match(/^"([a-z_]\w*)":\s+(.+?)(?:,)?(?:\s{2,}--\s+(.+))?$/);
      if (jsonMatch) {
        const { type, enumValues } = inferType(jsonMatch[2].trim(), jsonMatch[3]?.trim());
        current.fields.push({
          name: jsonMatch[1],
          type,
          enumValues,
          description: jsonMatch[3]?.trim(),
        });
        continue;
      }
    }

    // Notes: "Body ...", continuation lines
    if (current && line.startsWith('Body ')) {
      current.notes.push(line);
      if (line.includes('sections') && i + 1 < lines.length) {
        const next = lines[i + 1]?.match(/^--\s?(.*)/);
        if (next && /^\s*(Why|[A-Z])/.test(next[1])) {
          current.notes.push(next[1].trim());
          i++;
        }
      }
    }
  }

  if (current && current.fields.length > 0) entities.push(current);
  return entities;
}

// ── Type inference (for comment-based schemas) ──

function inferType(value: string, description?: string): { type: string; enumValues?: string[] } {
  if (value.includes('|')) {
    const values = value.split('|').map(p => p.trim().replace(/^"|"$/g, ''));
    return { type: 'enum', enumValues: values };
  }
  if (value === '[]') return { type: description?.includes('string') ? 'string[]' : 'array' };
  if (value.startsWith('[')) return { type: 'array' };
  if (value === 'true' || value === 'false') return { type: 'boolean' };
  if (value === 'null') return { type: 'nullable' };
  if (/^\d+$/.test(value)) return { type: 'number' };
  if (/\d{4}-\d{2}-\d{2}/.test(value.replace(/"/g, ''))) return { type: 'date' };
  return { type: 'string' };
}

// ── Heuristic relationship extraction (supplements REFERENCES) ──

function extractRelations(entities: SchemaEntity[]): SchemaRelation[] {
  const relations: SchemaRelation[] = [];

  for (const entity of entities) {
    for (const field of entity.fields) {
      if (field.isNested) continue;

      // Description mentions "task IDs"
      if (field.description) {
        const refMatch = field.description.match(/(task|feature|knowledge)\s+IDs?/i);
        if (refMatch) {
          const keyword = refMatch[1].toLowerCase();
          const target = entities.find(e => e.name.toLowerCase().includes(keyword));
          if (target && target.name !== entity.name) {
            const pk = target.fields.find(f => f.isPrimary);
            relations.push({
              from: entity.name,
              fromField: field.name,
              to: target.name,
              toField: pk ? pk.name : '_id',
              cardinality: field.type.includes('array') || field.type === 'array' ? '1:N' : '1:1',
            });
          }
        }
      }

      // Self-reference: parent_task, parent_id
      if (field.name === 'parent_task' || field.name === 'parent_id') {
        const pk = entity.fields.find(f => f.isPrimary);
        relations.push({
          from: entity.name,
          fromField: field.name,
          to: entity.name,
          toField: pk ? pk.name : '_id',
          cardinality: '1:1',
        });
      }
    }
  }

  return relations;
}
