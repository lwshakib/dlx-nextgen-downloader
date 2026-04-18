"use client";

import { Home, type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Project = {
  name: string;
  slug: string;
  icon: LucideIcon;
};

type NavProjectsProps = {
  projects: Project[];
  activeProject: string;
  onSelectProject: (slug: string) => void;
};

export function NavProjects({
  projects,
  activeProject,
  onSelectProject,
}: NavProjectsProps) {
  const allProjects: Project[] = [
    { name: "Home", slug: "home", icon: Home },
    ...projects,
  ];

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Platforms</SidebarGroupLabel>
      <SidebarMenu>
        {allProjects.map((item) => (
          <SidebarMenuItem key={item.slug}>
            <SidebarMenuButton
              className={cn(
                activeProject === item.slug &&
                  "bg-muted text-foreground hover:bg-muted"
              )}
              onClick={() => onSelectProject(item.slug)}
            >
              <item.icon />
              <span>{item.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
