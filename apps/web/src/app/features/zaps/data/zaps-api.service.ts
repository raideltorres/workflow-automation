import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  CopilotZapDraftRequest,
  RepositoryListResponse,
  Zap,
  ZapInput,
  ZapPatch,
  ZapRun,
} from '@workflow/shared';

const ZAPS_URL = '/api/zaps';

@Injectable({ providedIn: 'root' })
export class ZapsApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<Zap[]> {
    return this.http.get<Zap[]>(ZAPS_URL);
  }

  get(id: string): Observable<Zap> {
    return this.http.get<Zap>(`${ZAPS_URL}/${id}`);
  }

  create(input: ZapInput): Observable<Zap> {
    return this.http.post<Zap>(ZAPS_URL, input);
  }

  createCopilotDraft(input: CopilotZapDraftRequest): Observable<Zap> {
    return this.http.post<Zap>('/api/copilot/zap-drafts', input);
  }

  update(id: string, patch: ZapPatch): Observable<Zap> {
    return this.http.patch<Zap>(`${ZAPS_URL}/${id}`, patch);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${ZAPS_URL}/${id}`);
  }

  runs(id: string): Observable<ZapRun[]> {
    return this.http.get<ZapRun[]>(`${ZAPS_URL}/${id}/runs`);
  }

  repositories(): Observable<RepositoryListResponse> {
    return this.http.get<RepositoryListResponse>('/api/github/repositories');
  }
}
