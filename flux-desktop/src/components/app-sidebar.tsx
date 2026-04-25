"use client";

import {
  AudioWaveform,
  Command,
  Facebook,
  GalleryVerticalEnd,
  Home,
  Lock,
  Music2,
  Settings,
  Youtube,
} from "lucide-react";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Home",
      slug: "home",
      icon: Home,
    },
    {
      title: "YouTube",
      slug: "youtube",
      icon: Youtube,
    },
    {
      title: "Facebook",
      slug: "facebook",
      icon: Facebook,
    },
    {
      title: "Facebook Private Video",
      slug: "facebook-private-video",
      icon: Lock,
    },
    {
      title: "TikTok",
      slug: "tiktok",
      icon: Music2,
    },
    {
      title: "Settings",
      slug: "settings",
      icon: Settings,
    },
  ],
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeProject: string;
  onSelectProject: (slug: string) => void;
};

export function AppSidebar({
  activeProject,
  onSelectProject,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain}
          activeProject={activeProject}
          onSelectProject={onSelectProject}
        />
      </SidebarContent>
      <SidebarFooter>{/* <NavUser user={data.user} /> */}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
