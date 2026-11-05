import { Avatar } from "@/components/telefam/home/parts";
import { FollowButton } from "@/components/telefam/contacts/FollowButton";
import type { Contact } from "@/lib/contacts";

export function ContactRow({ contact }: { contact: Contact }) {
  const showFollowsYou = contact.followsMe && !contact.iFollow;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition-colors md:rounded-2xl md:border md:bg-card md:p-3.5 md:shadow-soft md:hover:border-primary/30">
      <Avatar
        url={contact.avatarUrl}
        path={contact.avatarPath}
        name={contact.fullName}
        className="size-11 text-sm md:size-12"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-tight">{contact.fullName}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">@{contact.username}</span>
          {contact.country && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{contact.country}</span>
            </>
          )}
        </p>
        {showFollowsYou && (
          <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
            Follows you
          </span>
        )}
      </div>
      <FollowButton contact={contact} />
    </li>
  );
}
