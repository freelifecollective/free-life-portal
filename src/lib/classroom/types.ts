export type CourseRow = { id: string; title: string; description: string | null; audience: "everyone" | "affiliates"; published: boolean; lessons: number; done: number; sort: number };
export type LessonRow = { id: string; course_id: string; title: string; body: string | null; vimeo_id: string | null; vimeo_hash: string | null; sort: number; published: boolean };
export const vimeoSrc = (id: string, hash: string | null) => `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}dnt=1&title=0&byline=0&portrait=0`;
