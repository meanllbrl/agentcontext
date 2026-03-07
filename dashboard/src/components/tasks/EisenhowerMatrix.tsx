import type { Task } from '../../hooks/useTasks';
import { TaskCard } from './TaskCard';
import './EisenhowerMatrix.css';

interface EisenhowerMatrixProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const HIGH_VALUES = ['critical', 'high'];

function isHigh(value: string): boolean {
  return HIGH_VALUES.includes(value);
}

interface Quadrant {
  key: string;
  label: string;
  subtitle: string;
  colorVar: string;
  filter: (t: Task) => boolean;
}

const QUADRANTS: Quadrant[] = [
  {
    key: 'do',
    label: 'Do First',
    subtitle: 'Important & Urgent',
    colorVar: '--color-quadrant-do',
    filter: (t) => isHigh(t.priority) && isHigh(t.urgency),
  },
  {
    key: 'schedule',
    label: 'Schedule',
    subtitle: 'Important & Not Urgent',
    colorVar: '--color-quadrant-schedule',
    filter: (t) => isHigh(t.priority) && !isHigh(t.urgency),
  },
  {
    key: 'delegate',
    label: 'Delegate',
    subtitle: 'Less Important & Urgent',
    colorVar: '--color-quadrant-delegate',
    filter: (t) => !isHigh(t.priority) && isHigh(t.urgency),
  },
  {
    key: 'eliminate',
    label: "Don't Do",
    subtitle: 'Less Important & Not Urgent',
    colorVar: '--color-quadrant-eliminate',
    filter: (t) => !isHigh(t.priority) && !isHigh(t.urgency),
  },
];

export function EisenhowerMatrix({ tasks, onTaskClick }: EisenhowerMatrixProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  return (
    <div className="eisenhower">
      <div className="eisenhower-y-label">
        <span className="eisenhower-axis-hi">Important</span>
        <span className="eisenhower-axis-lo">Less Important</span>
      </div>
      <div className="eisenhower-grid">
        {QUADRANTS.map(q => {
          const qTasks = activeTasks.filter(q.filter);
          return (
            <div key={q.key} className={`eisenhower-quadrant eisenhower-quadrant--${q.key}`}>
              <div className="eisenhower-quadrant-header">
                <span className="eisenhower-quadrant-dot" style={{ background: `var(${q.colorVar})` }} />
                <span className="eisenhower-quadrant-label">{q.label}</span>
                <span className="eisenhower-quadrant-count">{qTasks.length}</span>
              </div>
              <span className="eisenhower-quadrant-subtitle">{q.subtitle}</span>
              <div className="eisenhower-quadrant-cards">
                {qTasks.map(task => (
                  <TaskCard
                    key={task.slug}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onDragStart={() => {}}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="eisenhower-x-label">
        <span className="eisenhower-axis-hi">Urgent</span>
        <span className="eisenhower-axis-lo">Not Urgent</span>
      </div>
    </div>
  );
}
