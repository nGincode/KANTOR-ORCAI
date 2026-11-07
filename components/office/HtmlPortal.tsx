"use client";

import { createContext, useContext, type ComponentProps, type ReactNode, type RefObject } from "react";
import { Html } from "@react-three/drei";

const HtmlPortalContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function HtmlPortalProvider({
  value,
  children,
}: {
  value: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return <HtmlPortalContext.Provider value={value}>{children}</HtmlPortalContext.Provider>;
}

/**
 * drei's <Html> recreates its portal root whenever it cannot resolve a stable
 * target on the first commit, which trips React 19's unmount guard. Passing a
 * pre-mounted portal element keeps the target stable for every label.
 */
export function PortalHtml(props: ComponentProps<typeof Html>) {
  const portal = useContext(HtmlPortalContext);
  return (
    <Html
      {...props}
      portal={(portal ?? props.portal) as ComponentProps<typeof Html>["portal"]}
    />
  );
}
