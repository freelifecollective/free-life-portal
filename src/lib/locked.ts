/* The pages that are locked for Lacey's downline, with what to show behind the "members only" message:
   the page's name and subtitle, and the rough shape of the page (shown very faint, in grey). */
export type GhostKind = "cards" | "list" | "table" | "form" | "video" | "tree" | "calendar" | "gallery";
export const LOCKED: Record<string, { title: string; lede: string; kind: GhostKind }> = {
  "/outsourcing": { title: "Outsourcing", lede: "Find help from people in the community, or offer your own skills.", kind: "cards" },
  "/financing": { title: "Financing Options", lede: "Different options to help your leads get started.", kind: "cards" },
  "/responses": { title: "Verbiage + Objections", lede: "Answers the community has voted for as quality responses to messages from your leads.", kind: "list" },
  "/classroom": { title: "Courses", lede: "Courses with video lessons to help you learn, grow and build. Tick lessons off as you go.", kind: "cards" },
  "/business-launch": { title: "Business Launch Course", lede: "Your step-by-step course for launching your business.", kind: "video" },
  "/calls": { title: "Calls", lede: "Join calls live, or watch the recordings any time.", kind: "gallery" },
  "/buddy": { title: "Accountability Buddy", lede: "Find someone to keep you on track.", kind: "cards" },
  "/calculator": { title: "Earnings Estimator", lede: "Select your country and amount of points you currently receive to see your commissions.", kind: "gallery" },
  "/create-quote": { title: "Create a Quote", lede: "Choose the products, add your lead's name, tax and shipping, and send them a quote they can keep or share.", kind: "table" },
  "/graphic-maker": { title: "Graphic Maker", lede: "Make a picture with your photo, name and invite link on it, ready to post.", kind: "form" },
  "/family-tree": { title: "Your Organization", lede: "Map out your current organization or vision-board your way to higher ranks.", kind: "tree" },
  "/tasks": { title: "Tasks", lede: "Everything you want to get done, for your business and your life. Tick things off, reorder them, and we will remind you.", kind: "list" },
  "/call-closers": { title: "Call Closers for Hire", lede: "Hire an experienced closer to take your coaching calls for you.", kind: "cards" },
  "/facebook-follows": { title: "Facebook Follows", lede: "Help new members reach their first 50 Facebook follows.", kind: "list" },
  "/resources/books": { title: "Books", lede: "Books we recommend reading.", kind: "gallery" },
  "/resources/product-information": { title: "Product Information", lede: "Everything you need to know about the products.", kind: "gallery" },
  "/advertising/pictures-videos": { title: "Pictures/Videos", lede: "Pictures and videos you can use and share.", kind: "gallery" },
  "/advertising/canva-templates": { title: "Canva Templates", lede: "Templates you can open and make your own in Canva.", kind: "gallery" },
  "/advertising/evidence-manual": { title: "Evidence Manual", lede: "Real people who have found success. Copy a story or download a picture to share.", kind: "cards" },
  "/advertising/landing-page": { title: "Landing Page", lede: "The page your leads see when you send them your link.", kind: "video" },
};
