import { useState } from 'react';
import type { Task } from '../../hooks/useTasks';
import { TaskCard } from './TaskCard';
import './KanbanColumn.css';

interface KanbanColumnProps {
  title: string;
  status: string;
  tasks: Task[];
  count: number;
  colorVar: string;
  onTaskClick: (task: Task) => void;
  onDrop: (slug: string, newStatus: string) => void;
}

export function KanbanColumn({ title, status, tasks, count, colorVar, onTaskClick, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const slug = e.dataTransfer.getData('text/plain');
    if (slug) {
      onDrop(slug, status);
    }
  };

  return (
    <div
      className={`kanban-column ${isDragOver ? 'kanban-column--dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="kanban-column-header">
        <span className="kanban-column-dot" style={{ background: `var(${colorVar})` }} />
        <span className="kanban-column-title">{title}</span>
        <span className="kanban-column-count">{count}</span>
      </div>
      <div className="kanban-column-cards">
        {tasks.map(task => (
          <TaskCard
            key={task.slug}
            task={task}
            onClick={() => onTaskClick(task)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', task.slug);
              e.dataTransfer.effectAllowed = 'move';
            }}
          />
        ))}
      </div>
    </div>
  );
}
