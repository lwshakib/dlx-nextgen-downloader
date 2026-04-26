import { Icon } from "@iconify/react";
import { type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import { cn } from "@/lib/utils";

type NavMainItem = {
  title: string;
  slug: string;
  icon: LucideIcon | string;
};

type NavMainProps = {
  items: NavMainItem[];
  activeProject: string;
  onSelectProject: (slug: string) => void;
};

export function NavMain({
  items,
  activeProject,
  onSelectProject,
}: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.slug}
            asChild
            className="group/collapsible"
            defaultOpen={activeProject === item.slug}
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    "cursor-pointer",
                    activeProject === item.slug &&
                      "bg-muted text-foreground hover:bg-muted"
                  )}
                  tooltip={item.title}
                  onClick={() => onSelectProject(item.slug)}
                >
                  {typeof item.icon === "string" ? (
                    <Icon icon={item.icon} className="size-4" />
                  ) : (
                    <item.icon />
                  )}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent />
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
