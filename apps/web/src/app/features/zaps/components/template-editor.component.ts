import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';

import { type OutputField, renderTemplate, toTemplateToken } from '@workflow/shared';

/** Textarea with insertable trigger fields: the builder's field mapping. */
@Component({
  selector: 'app-template-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatChipsModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TemplateEditorComponent), multi: true }],
  styleUrl: './template-editor.component.scss',
  template: `
    <label class="label" [for]="inputId()">{{ label() }}</label>
    <textarea
      #textarea
      class="textarea"
      rows="3"
      [id]="inputId()"
      [value]="value()"
      [disabled]="disabled()"
      [attr.aria-invalid]="!!error()"
      (input)="onInput(textarea.value)"
      (blur)="onTouched()"
    ></textarea>
    @if (error(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }

    <p class="hint">Insert data from the trigger:</p>
    <mat-chip-set aria-label="Trigger fields">
      @for (field of fields(); track field.key) {
        <mat-chip (click)="insert(field)" [disabled]="disabled()" [attr.title]="'e.g. ' + field.example">
          {{ field.label }}
        </mat-chip>
      }
    </mat-chip-set>

    @if (value()) {
      <div class="preview">
        <span class="preview-label">Preview with sample data</span>
        <p>{{ preview() }}</p>
      </div>
    }
  `,
})
export class TemplateEditorComponent implements ControlValueAccessor {
  readonly fields = input.required<readonly OutputField[]>();
  readonly label = input('Value');
  readonly inputId = input('template-editor');
  readonly error = input<string | null>(null);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly preview = computed(() => {
    const sample = Object.fromEntries(this.fields().map((field) => [field.key, field.example]));
    return renderTemplate(this.value(), sample);
  });

  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }

  protected insert(field: OutputField): void {
    const element = this.textarea().nativeElement;
    const token = toTemplateToken(field.key);
    const current = this.value();
    const start = element.selectionStart ?? current.length;
    const end = element.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);

    this.onInput(next);
    this.onTouched();
    queueMicrotask(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }
}
