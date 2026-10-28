import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  type Signal,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import {
  ACTIONS,
  APPS,
  type AccessibleRepository,
  type ActionKey,
  type AppId,
  COMMENT_BODY_MAX_LENGTH,
  type OutputField,
  TRIGGERS,
  type TriggerKey,
  ZAP_NAME_MAX_LENGTH,
  type Zap,
  ZapInputSchema,
  type ZapRun,
  findTrigger,
} from '@workflow/shared';

import { SIGN_IN_URL } from '../../../core/auth/auth.service';
import { toErrorMessage } from '../../../shared/http-error';
import { AppPickerComponent } from '../components/app-picker.component';
import { TemplateEditorComponent } from '../components/template-editor.component';
import { ZapRunListComponent } from '../components/zap-run-list.component';
import { ZapsApiService } from '../data/zaps-api.service';
import { type UnknownTokensError, knownTemplateTokensValidator } from '../template-validators';

const DEFAULT_TRIGGER: TriggerKey = 'github.pull_request.opened';
const DEFAULT_ACTION: ActionKey = 'github.pull_request.comment';
const DEFAULT_COMMENT = 'Thanks @{{pull_request.author}} for opening "{{pull_request.title}}"! We will review it soon.';

@Component({
  selector: 'app-zap-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    AppPickerComponent,
    TemplateEditorComponent,
    ZapRunListComponent,
  ],
  templateUrl: './zap-editor.page.html',
  styleUrl: './zap-editor.page.scss',
})
export class ZapEditorPage implements OnInit {
  /** Route param; undefined on /zaps/new. */
  readonly id = input<string>();

  private readonly api = inject(ZapsApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly apps = APPS;
  protected readonly signInUrl = SIGN_IN_URL;
  protected readonly triggerApp = signal<AppId>('github');
  protected readonly actionApp = signal<AppId>('github');
  protected readonly triggers = computed(() => TRIGGERS.filter((t) => t.app === this.triggerApp()));
  protected readonly actions = computed(() => ACTIONS.filter((a) => a.app === this.actionApp()));

  protected readonly repositories = signal<readonly AccessibleRepository[]>([]);
  protected readonly installUrl = signal<string | null>(null);
  protected readonly runs = signal<readonly ZapRun[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.id() !== undefined);

  // Declared before the form: the body validator reads outputFields as soon as the control is created.
  private readonly triggerKeyControl = this.fb.control<TriggerKey>(DEFAULT_TRIGGER, Validators.required);
  private readonly triggerKey: Signal<TriggerKey> = toSignal(this.triggerKeyControl.valueChanges, {
    initialValue: this.triggerKeyControl.value,
  });
  protected readonly outputFields: Signal<readonly OutputField[]> = computed(
    () => findTrigger(this.triggerKey()).outputFields,
  );

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(ZAP_NAME_MAX_LENGTH)]],
    enabled: [false],
    triggerKey: this.triggerKeyControl,
    repositoryId: new FormControl<number | null>(null, Validators.required),
    actionKey: this.fb.control<ActionKey>(DEFAULT_ACTION, Validators.required),
    body: [
      DEFAULT_COMMENT,
      [
        Validators.required,
        Validators.maxLength(COMMENT_BODY_MAX_LENGTH),
        knownTemplateTokensValidator(() => this.outputFields()),
      ],
    ],
  });

  ngOnInit(): void {
    const id = this.id();
    forkJoin({
      repositories: this.api.repositories(),
      zap: id ? this.api.get(id) : of(null),
      runs: id ? this.api.runs(id) : of([]),
    }).subscribe({
      next: ({ repositories, zap, runs }) => {
        this.repositories.set(repositories.repositories);
        this.installUrl.set(repositories.installUrl);
        this.runs.set(runs);
        if (zap) this.patchForm(zap);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.loadError.set(toErrorMessage(error, 'Could not load the Zap builder'));
      },
    });
  }

  protected bodyError(): string | null {
    const control = this.form.controls.body;
    if (!control.touched && !control.dirty) return null;
    if (control.hasError('required')) return 'Comment is required';
    if (control.hasError('maxlength')) return 'Comment is too long';
    const unknown = control.getError('unknownTokens') as UnknownTokensError['unknownTokens'] | null;
    return unknown ? `Unknown fields: ${unknown.join(', ')}` : null;
  }

  protected refreshRuns(): void {
    const id = this.id();
    if (!id) return;
    this.api.runs(id).subscribe({
      next: (runs) => this.runs.set(runs),
      error: (error: unknown) => this.notify(toErrorMessage(error, 'Could not load runs')),
    });
  }

  protected save(): void {
    this.formError.set(null);
    this.form.markAllAsTouched();

    const raw = this.form.getRawValue();
    const parsed = ZapInputSchema.safeParse({
      name: raw.name,
      enabled: raw.enabled,
      trigger: { key: raw.triggerKey, config: { repositoryId: raw.repositoryId } },
      action: { key: raw.actionKey, input: { body: raw.body } },
    });
    if (!parsed.success || this.form.invalid) {
      this.formError.set(parsed.error?.issues[0]?.message ?? 'Please fix the highlighted fields');
      return;
    }

    const id = this.id();
    const request = id ? this.api.update(id, parsed.data) : this.api.create(parsed.data);
    this.saving.set(true);
    request.subscribe({
      next: (zap) => {
        this.saving.set(false);
        this.notify(id ? 'Zap saved' : 'Zap created');
        if (!id) void this.router.navigate(['/zaps', zap.id], { replaceUrl: true });
        else this.patchForm(zap);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(toErrorMessage(error, 'Could not save the Zap'));
      },
    });
  }

  private patchForm(zap: Zap): void {
    this.form.reset({
      name: zap.name,
      enabled: zap.enabled,
      triggerKey: zap.trigger.key,
      repositoryId: zap.trigger.config.repositoryId,
      actionKey: zap.action.key,
      body: zap.action.input.body,
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 4000 });
  }
}
