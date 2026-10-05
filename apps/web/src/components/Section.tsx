import { useId, type ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader } from './ui/card';

/** A card in a `<section>` named by its `<h2>` heading, with an optional action next to the
 *  heading. Pass `headingId` when something inside, such as a table, is labelled by it too. */
export function Section({
  title,
  headingId,
  action,
  children,
}: {
  title: string;
  headingId?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const fallbackId = useId();
  const id = headingId ?? fallbackId;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <Card className="h-full">
        <CardHeader>
          <h2 id={id} className="font-heading text-base leading-normal font-semibold">
            {title}
          </h2>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
