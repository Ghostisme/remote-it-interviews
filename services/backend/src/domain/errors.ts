/** Expected business failure translated into a typed API error by the HTTP boundary. */
export class DomainError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
