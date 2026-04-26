"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import { ChevronsUpDown, Plus } from "lucide-react";
import * as React from "react";

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string;
    logo: React.ElementType;
    plan: string;
  }[];
}) {
  const activeTeam = teams[0];

  if (!activeTeam) {
    return null;
  }

  return (
    <SidebarMenu className="drag-css">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="hover:bg-transparent active:bg-transparent focus-visible:ring-0 h-fit py-2"
        >
          <img src="/logo.svg" className="size-8 block shrink-0" alt="Logo" />
          <div className="flex flex-1 items-center text-left text-sm leading-tight">
            <span className="truncate font-semibold">DLX NextGen Downloader</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
