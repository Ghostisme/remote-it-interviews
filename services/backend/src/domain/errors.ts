export class DomainError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
