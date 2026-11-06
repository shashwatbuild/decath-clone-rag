import Link from "next/link";
import { TopBar } from "@/components/ui";

const NOTES = [
  { title: "Save ₹100 on your first order", body: "Use code NC100 on orders above ₹1,499.", href: "/c/all", when: "Today" },
  { title: "Price drop on footballs ⚽", body: "Training balls now from ₹599.", href: "/c/footballs", when: "Today" },
  { title: "New arrivals in running", body: "Kiprun Kipride Max is here: max cushioning for long runs.", href: "/p/8960547", when: "Yesterday" },
  { title: "Not sure what to buy?", body: "Ask our chat assistant to compare products for you.", href: "/chat", when: "2 days ago" },
];

export default function NotificationsPage() {
  return (
    <main className="pb-10">
      <TopBar title="Notifications" />
      <ul className="divide-y divide-line">
        {NOTES.map((n) => (
          <li key={n.title}>
            <Link href={n.href} className="flex gap-3 px-4 py-4">
              <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold text-[15px]">{n.title}</span>
                <span className="block text-[14px] text-muted mt-0.5">{n.body}</span>
                <span className="block text-[12px] text-[#9a9a9a] mt-1.5">{n.when}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
