export interface SchemaField {
  name: string;
  type: string;
  enumValues?: string[];
  description?: string;
  isPrimary?: boolean;
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

/**
 * Parse SQL content into schema representation.
 * Handles standard CREATE TABLE and comment-based schema docs.
 */
export function parseSqlContent(content: string): ParsedSchema {
  const createEntities = parseCreateTables(content);
  const commentEntities = parseCommentSchemas(content);

  const seen = new Set(createEntities.map(e => e.name.toLowerCase()));
  const entities = [
    ...createEntities,
    ...commentEntities.filter(e => !seen.has(e.name.toLowerCase())),
  ];

  const relations = extractRelations(entities);
  return { entities, relations };
}

// ── Standard SQL CREATE TABLE ──

function parseCreateTables(content: string): SchemaEntity[] {
  const entities: SchemaEntity[] = [];
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\);/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const fields: SchemaField[] = [];

    for (const line of body.split(',').map(l => l.trim()).filter(Boolean)) {
      if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX)/i.test(line)) continue;
      const colMatch = line.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]*\))?)\s*(.*)/i);
      if (colMatch) {
        fields.push({
          name: colMatch[1],
          type: colMatch[2].toLowerCase(),
          isPrimary: /PRIMARY\s+KEY/i.test(colMatch[3]),
        });
      }
    }
    entities.push({ name, fields, storageType: 'table', notes: [] });
  }
  return entities;
}

// ── Comment-based schema parser ──

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

// ── Type inference ──

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

// ── Relationship extraction ──

function extractRelations(entities: SchemaEntity[]): SchemaRelation[] {
  const relations: SchemaRelation[] = [];
  const entityNames = entities.map(e => e.name.toLowerCase());

  for (const entity of entities) {
    for (const field of entity.fields) {
      // Description mentions "task IDs"
      if (field.description) {
        const refMatch = field.description.match(/(task|feature|knowledge)\s+IDs?/i);
        if (refMatch) {
          const keyword = refMatch[1].toLowerCase();
          const target = entities.find(e => e.name.toLowerCase().includes(keyword));
          if (target && target.name !== entity.name) {
            relations.push({
              from: entity.name,
              fromField: field.name,
              to: target.name,
              toField: 'id',
              cardinality: field.type.includes('array') || field.type === 'array' ? '1:N' : '1:1',
            });
          }
        }
      }

      // Self-reference: parent_task, parent_id
      if (field.name === 'parent_task' || field.name === 'parent_id') {
        relations.push({
          from: entity.name,
          fromField: field.name,
          to: entity.name,
          toField: 'id',
          cardinality: '1:1',
        });
      }

      // Standard SQL REFERENCES
      if (field.description) {
        const sqlRef = field.description.match(/references\s+(\w+)\((\w+)\)/i);
        if (sqlRef && entityNames.includes(sqlRef[1].toLowerCase())) {
          relations.push({
            from: entity.name,
            fromField: field.name,
            to: sqlRef[1],
            toField: sqlRef[2],
            cardinality: '1:1',
          });
        }
      }
    }
  }

  return relations;
}
