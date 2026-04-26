"use client";

import {
  AudioWaveform,
  Command,
  GalleryVerticalEnd,
  Home,
  Settings,
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
} from "@workspace/ui/components/sidebar";

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
      icon: "logos:youtube-icon",
    },
    {
      title: "Facebook",
      slug: "facebook",
      icon: "logos:facebook",
    },
    {
      title: "Facebook Private Video",
      slug: "facebook-private-video",
      icon: "mdi:lock",
    },
    {
      title: "TikTok",
      slug: "tiktok",
      icon: "logos:tiktok-icon",
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
