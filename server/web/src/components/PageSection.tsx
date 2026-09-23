import { useId, type ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardPanel,
  CardFooter,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameDescription,
  CardFrameAction,
  CardFrameFooter,
} from "./ui/card";
import { cn } from "../lib/utils";

/** Panels use one surface; card tables provide their own content border. */
export default function PageSection({
  title,
  description,
  actions,
  children,
  footer,
  flush = false,
  table = false,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  table?: boolean;
  className?: string;
  id?: string;
}) {
  const heading = useId();
  const Root = table ? CardFrame : Card;
  const Header = table ? CardFrameHeader : CardHeader;
  const Title = table ? CardFrameTitle : CardTitle;
  const Description = table ? CardFrameDescription : CardDescription;
  const Action = table ? CardFrameAction : CardAction;
  const Footer = table ? CardFrameFooter : CardFooter;
  return (
    <Root
      render={
        <section
          id={id}
          tabIndex={id ? -1 : undefined}
          aria-labelledby={heading}
        />
      }
      className={cn("min-w-0", table && "isolate before:-z-10", className)}
    >
      <Header className="gap-3 px-4 py-4 md:px-6">
        <Title render={<h2 id={heading} />} className="text-base">
          {title}
        </Title>
        {description && (
          <Description className="max-w-prose [&_a]:underline">
            {description}
          </Description>
        )}
        {actions && (
          <Action className="flex min-w-0 flex-wrap items-center gap-2">
            {actions}
          </Action>
        )}
      </Header>
      {table ? (
        children
      ) : (
        <CardPanel
          className={cn("min-w-0", flush ? "p-0" : "px-4 pb-4 md:px-6 md:pb-6")}
        >
          {children}
        </CardPanel>
      )}
      {footer && (
        <Footer className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          {footer}
        </Footer>
      )}
    </Root>
  );
}
