/** The Business Launch Course is the course whose title starts with these words. It has its own tab, and is left out of the Courses list. */
export const isLaunchCourse = (title: string) => /^\s*business\s+launch/i.test(title);
