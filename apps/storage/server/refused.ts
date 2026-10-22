// A request that cannot be answered as asked, and what to tell the person:
// its message goes back to the page, unlike that of anything else that fails,
// which may name the bucket or the account and stays in the log.

export class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
