import {
  Children,
  type ComponentProps,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { NavLink } from 'react-router';
import { AppIcon, QuickActionsTrigger, Sidebar } from '../../lib/core.ts';

export type SidebarProps = ComponentProps<typeof Sidebar>;

/** Where a page lives; the rail highlights it and the panel is titled after it. */
export type Area = 'home' | 'admin' | 'server';

export function areaOf(pathname: string): Area {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname.startsWith('/server/')) return 'server';
  return 'home';
}

/** The props Zoron reads off core's sidebar nodes: a link's target, a divider's label, a wrapper's content. */
type NodeProps = { to?: unknown; label?: unknown; children?: ReactNode };

/**
 * The routers wrap menus in fragments, which Children.toArray keeps as single nodes. Children of a nested fragment
 * get its key as a prefix, so the admin categories (one fragment each) don't hand out the same keys twice.
 */
function flatten(children: ReactNode, prefix: string): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement<NodeProps>(child) && child.type === Fragment) {
      return flatten(child.props.children, `${prefix}${child.key}/`);
    }
    return isValidElement(child) ? [cloneElement(child, { key: `${prefix}${child.key}` })] : [child];
  });
}

function isDivider(node: ReactNode): node is ReactElement<NodeProps> {
  return isValidElement(node) && node.type === Sidebar.Divider;
}

/** The rail has the logo, search, Home and Admin, so the panel leaves out core's copies of them. */
function railCovers(node: ReactNode): boolean {
  if (!isValidElement<NodeProps>(node)) return false;
  if (node.type === QuickActionsTrigger) return true;
  if (node.type === NavLink) return isValidElement(node.props.children) && node.props.children.type === AppIcon;
  return node.type === Sidebar.Link && (node.props.to === '/' || node.props.to === '/admin');
}

/** The context panel's content: core's header, pinned above the scroll, and its menu. */
export type PanelNodes = { head: ReactNode[]; menu: ReactNode[] };

/**
 * What the context panel lists: core's header (the server block on server pages) and menu, in core's order, with
 * its wrappers (ServerCan, AdminCan) intact, minus what the rail covers. Plain rules left leading, trailing or
 * doubled by that are dropped; labelled ones title a section and stay. Spacer divs don't count as content. As in
 * core's sidebar, the header stays pinned above the scrolling menu; `head` is empty when nothing of it is left.
 */
export function panelNodes(header: ReactNode, children: ReactNode): PanelNodes {
  const fromHeader = flatten(header, 'h/').filter((node) => !railCovers(node));
  const kept = [...fromHeader, ...flatten(children, 'c/').filter((node) => !railCovers(node))];
  const content = (node: ReactNode) => isValidElement(node) && node.type !== 'div';
  const shown = kept.map((node, i) => {
    if (!isDivider(node) || node.props.label) return true;
    const next = kept.slice(i + 1).find(content);
    return kept.slice(0, i).some((n) => content(n) && !isDivider(n)) && next !== undefined && !isDivider(next);
  });
  const head = fromHeader.filter((_, i) => shown[i]);
  return {
    head: head.some(content) ? head : [],
    menu: kept.slice(fromHeader.length).filter((_, i) => shown[fromHeader.length + i]),
  };
}
