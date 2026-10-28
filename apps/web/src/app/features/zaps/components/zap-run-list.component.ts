import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ZapRun } from '@workflow/shared';

@Component({
  selector: 'app-zap-run-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (runs().length === 0) {
      <p class="muted">No runs yet. Open a pull request in the selected repository to trigger this Zap.</p>
    } @else {
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Pull request</th>
            <th scope="col">Started</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          @for (run of runs(); track run.id) {
            <tr>
              <td><span class="status" [attr.data-status]="run.status">{{ run.status }}</span></td>
              <td>
                <a [href]="run.trigger.pullRequestUrl" target="_blank" rel="noopener">
                  #{{ run.trigger.pullRequestNumber }} {{ run.trigger.pullRequestTitle }}
                </a>
              </td>
              <td>{{ run.startedAt | date: 'short' }}</td>
              <td>
                @if (run.output) {
                  <a [href]="run.output.commentUrl" target="_blank" rel="noopener">View comment</a>
                } @else if (run.error) {
                  <span class="error">{{ run.error }}</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    .muted { color: var(--mat-sys-on-surface-variant); font-size: 14px; }
    .table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    th { font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    .status { padding: 2px 8px; border-radius: 4px; font-size: 12px; background: var(--mat-sys-surface-container-high); }
    .status[data-status='succeeded'] { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .status[data-status='failed'] { background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
    .error { color: var(--mat-sys-error); }
  `,
})
export class ZapRunListComponent {
  readonly runs = input.required<readonly ZapRun[]>();
}
