import type { ReactNode } from "react";

export type TabProps<TTabId extends string = string> = {
  id: TTabId;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
};

export function Tab<TTabId extends string = string>(_props: TabProps<TTabId>) {
  return null;
}
