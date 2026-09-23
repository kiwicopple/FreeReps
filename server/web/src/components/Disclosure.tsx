import { Children, isValidElement, type ReactNode, type CSSProperties } from "react";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "./ui/collapsible";
import { Button } from "./ui/button";
/** Independent disclosure; content stays mounted to preserve form drafts. */
export default function Disclosure({children,className,style}: {children:ReactNode;className?:string;style?:CSSProperties}) {
 const parts=Children.toArray(children); const first=parts[0];
 const label=isValidElement<{children?:ReactNode}>(first)?first.props.children:first;
 return <Collapsible className={className} style={style}>
  <CollapsibleTrigger render={<Button variant="ghost" className="h-auto justify-start whitespace-normal text-left"/>}>{label}</CollapsibleTrigger>
  <CollapsiblePanel keepMounted>{parts.slice(1)}</CollapsiblePanel>
 </Collapsible>;
}
