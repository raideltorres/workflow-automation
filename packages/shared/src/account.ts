export interface CurrentUser {
  readonly id: string;
  readonly login: string;
  readonly name: string | null;
  readonly avatarUrl: string;
}

export interface AccessibleRepository {
  readonly id: number;
  readonly fullName: string;
  readonly private: boolean;
}

export interface RepositoryListResponse {
  readonly repositories: readonly AccessibleRepository[];
  readonly installUrl: string;
}

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
