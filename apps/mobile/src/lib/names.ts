/** How a username is shown: "השועל_החכם" reads as "השועל החכם" (usernames can't hold spaces). */
export function showName(username: string | null | undefined): string {
  return (username ?? '').replace(/_+/g, ' ').trim();
}
