import { createProject, parseTemplate } from '@planner/schema';
import templateJson from '@planner/template-therapeutic-recovery/template.json';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from '../src/lib/editorStore';

const parsed = parseTemplate(templateJson);
if (!parsed.ok) throw new Error('template invalid');

const project = createProject({
  id: 'p',
  name: 'Test',
  format: 'A4',
  locale: 'en',
  now: '2026-09-24T00:00:00.000Z',
  template: parsed.value,
});

const rename = (name: string) => (p: typeof project) => ({ ...p, meta: { ...p.meta, name } });

describe('editor store', () => {
  beforeEach(() => useEditor.getState().load(project));

  it('records one undo step per command and marks the project unsaved', () => {
    const s = useEditor.getState;
    s().apply('Rename', rename('A'));
    s().apply('Rename', rename('B'));
    expect(s().project?.meta.name).toBe('B');
    expect(s().save).toBe('unsaved');
    expect(s().history.past).toHaveLength(2);

    s().undo();
    expect(s().project?.meta.name).toBe('A');
    s().undo();
    expect(s().project).toBe(project);
    s().redo();
    expect(s().project?.meta.name).toBe('A');
    expect(s().status).toBe('Rename');
  });

  it('merges quick edits with the same merge key into one step', () => {
    const s = useEditor.getState;
    s().apply('Typing', rename('a'), 'name');
    s().apply('Typing', rename('ab'), 'name');
    s().apply('Typing', rename('abc'), 'name');
    expect(s().history.past).toHaveLength(1);
    s().undo();
    expect(s().project).toBe(project);
  });

  it('ignores commands that change nothing', () => {
    useEditor.getState().apply('Nothing', (p) => p);
    expect(useEditor.getState().history.past).toHaveLength(0);
    expect(useEditor.getState().save).toBe('saved');
  });

  it('only marks saved when the saved snapshot is still the current project', () => {
    const s = useEditor.getState;
    s().apply('Rename', rename('A'));
    const saving = s().project!;
    s().apply('Rename', rename('B'));
    s().markSaved('saved', saving);
    expect(s().save).toBe('unsaved');
    s().markSaved('saved', s().project!);
    expect(s().save).toBe('saved');
  });
});
