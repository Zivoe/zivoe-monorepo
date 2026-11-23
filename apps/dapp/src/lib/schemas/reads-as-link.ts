/**
 * Whether a name that emails and ops lines repeat would read as a link or an
 * address, which mail clients turn into something to click.
 */
export const readsAsLink = (name: string) =>
  name.includes('://') || name.includes('@') || /[\p{L}\p{N}-]{2,}\.[\p{L}]{2,}/u.test(name);

/** No line break or control character: a name goes into an email's subject and one line of an ops message. */
export const isOneLine = (text: string) => /^[^\p{Cc}\p{Zl}\p{Zp}]*$/u.test(text);
