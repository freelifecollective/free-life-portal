import { redirect } from "next/navigation";

/** Groups live inside Chats now (under Group Chats), so this old address just goes there. */
export default function GroupsPage() {
  redirect("/chats");
}
