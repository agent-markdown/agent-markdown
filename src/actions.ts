import type { Action } from './types';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;
type SavedInput = { value: string; checked?: boolean };
interface Interaction {
  inputs: Map<string, SavedInput>;
  pending: boolean;
  response?: string;
  error?: string;
  refresh: () => void;
}

/** Interaction state belongs to a present component, never a detached DOM listener. */
export class ActionController {
  private records = new Map<string, Interaction>();
  private generation = 0;
  private listeners: (() => void)[] = [];

  private clearListeners() {
    this.listeners.forEach((remove) => remove());
    this.listeners = [];
  }

  private listen<K extends keyof HTMLElementEventMap>(
    node: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) {
    node.addEventListener(type, listener);
    this.listeners.push(() => node.removeEventListener(type, listener));
  }

  reset() {
    this.clearListeners();
    this.generation++;
    this.records.clear();
  }

  bind(root: HTMLElement, handlers: Record<string, Action> | undefined, streaming: boolean) {
    this.clearListeners();
    const generation = ++this.generation;
    const present = new Set<string>();
    const recordFor = (key: string) => {
      present.add(key);
      let record = this.records.get(key);
      if (!record) {
        record = { inputs: new Map(), pending: false, refresh: () => {} };
        this.records.set(key, record);
      }
      return record;
    };
    const handlerFor = (name: string) =>
      handlers && Object.hasOwn(handlers, name) && typeof handlers[name] === 'function'
        ? handlers[name]
        : undefined;
    const canSubmit = (node: HTMLElement, record: Interaction, handler?: Action) =>
      generation === this.generation &&
      root.contains(node) &&
      !streaming &&
      !!handler &&
      !record.pending &&
      record.response === undefined;

    root.querySelectorAll<HTMLFormElement>('form').forEach((form, index) => {
      const name = form.dataset.afmAction ?? '';
      const key = `form:${form.id || index}:${name}`;
      const record = recordFor(key),
        handler = handlerFor(name);
      const controls = Array.from(form.querySelectorAll<Control>('input,textarea,select,button'));
      const authoredDisabled = new Set(controls.filter((control) => control.disabled));
      const fields = controls.filter(
        (control): control is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
          control.localName !== 'button',
      );
      form.dataset.afmForm = key;
      const save = () =>
        fields.forEach((field) =>
          record.inputs.set(field.dataset.afmInput!, {
            value: field.value,
            checked: field instanceof HTMLInputElement ? field.checked : undefined,
          }),
        );
      fields.forEach((field, fieldIndex) => {
        field.dataset.afmInput = `${key}:${field.name}:${fieldIndex}`;
        const saved = record.inputs.get(field.dataset.afmInput);
        if (saved) {
          field.value = saved.value;
          if (field instanceof HTMLInputElement && saved.checked !== undefined)
            field.checked = saved.checked;
        }
        this.listen(field, 'input', () => {
          if (generation !== this.generation) return;
          if (field instanceof HTMLTextAreaElement) {
            const row = field.closest('fieldset > div');
            const radio = row?.querySelector<HTMLInputElement>(
              ':scope > label > input[type="radio"]',
            );
            if (radio && !radio.disabled) radio.checked = true;
          }
          save();
        });
      });
      const output = document.createElement('p');
      output.className = 'form-result';
      output.setAttribute('role', 'status');
      form.append(output);
      record.refresh = () => {
        const disabled = streaming || !handler || record.pending || record.response !== undefined;
        controls.forEach((control) => {
          control.disabled = authoredDisabled.has(control) || disabled;
        });
        output.textContent = !handler
          ? 'This host does not support this action.'
          : (record.response ?? record.error ?? (record.pending ? 'Submitting…' : ''));
      };
      record.refresh();
      this.listen(form, 'reset', (event) => {
        if (
          generation !== this.generation ||
          streaming ||
          record.pending ||
          record.response !== undefined
        ) {
          event.preventDefault();
          return;
        }
        record.inputs.clear();
        record.error = undefined;
        record.refresh();
      });
      this.listen(form, 'submit', (event) => {
        event.preventDefault();
        if (!canSubmit(form, record, handler) || !form.reportValidity()) return;
        const values: Record<string, string | string[]> = Object.create(null);
        const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
        new FormData(form, submitter).forEach((entry, field) => {
          const value = String(entry),
            previous = values[field];
          values[field] =
            previous === undefined
              ? value
              : Array.isArray(previous)
                ? [...previous, value]
                : [previous, value];
        });
        void this.submit(key, record, handler!, values, true);
      });
    });

    root.querySelectorAll<HTMLButtonElement>('button[data-afm-action]').forEach((button, index) => {
      if (button.closest('form')) return;
      const name = button.dataset.afmAction!;
      const key = `button:${button.id || index}:${name}`;
      const record = recordFor(key),
        handler = handlerFor(name);
      const authoredDisabled = button.disabled;
      button.dataset.afmButton = key;
      record.refresh = () => {
        button.disabled =
          authoredDisabled ||
          streaming ||
          !handler ||
          record.pending ||
          record.response !== undefined;
        const label = record.response ?? record.error ?? (record.pending ? 'Working…' : undefined);
        if (label !== undefined) button.textContent = label;
      };
      record.refresh();
      this.listen(button, 'click', () => {
        if (button.disabled || !canSubmit(button, record, handler)) return;
        void this.submit(key, record, handler!, Object.create(null), false);
      });
    });
    for (const key of this.records.keys()) if (!present.has(key)) this.records.delete(key);
  }

  private async submit(
    key: string,
    record: Interaction,
    handler: Action,
    values: Record<string, string | string[]>,
    form: boolean,
  ) {
    record.pending = true;
    record.error = undefined;
    record.refresh();
    try {
      const response = await handler(values);
      if (this.records.get(key) === record) record.response = response;
    } catch (error) {
      if (this.records.get(key) === record)
        record.error = form
          ? `Could not submit: ${error instanceof Error ? error.message : 'Try again'}`
          : 'Try again';
    } finally {
      if (this.records.get(key) === record) {
        record.pending = false;
        record.refresh();
      }
    }
  }
}
