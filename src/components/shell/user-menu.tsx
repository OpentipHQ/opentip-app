"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsFor } from "@/lib/profile/avatar";

export type MenuUser = {
  login: string;
  name: string | null;
  imageUrl: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
};

export function UserMenu({ user }: { user: MenuUser }) {
  const avatar = user.imageUrl || user.avatarUrl || "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-9 gap-2 rounded-full px-1.5 pr-3">
            <Avatar size="sm">
              {avatar ? <AvatarImage src={avatar} alt="" /> : null}
              <AvatarFallback>{initialsFor(user.name, user.login)}</AvatarFallback>
            </Avatar>
            <span className="max-w-32 truncate text-sm">{user.name || user.login}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.name || user.login}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>Profile</DropdownMenuItem>
        {user.role === "ADMIN" ? (
          <DropdownMenuItem render={<Link href="/admin" />}>Admin</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action="/api/auth/sign-out" method="post">
          <DropdownMenuItem
            variant="destructive"
            render={<button type="submit" className="w-full text-left" />}
          >
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
