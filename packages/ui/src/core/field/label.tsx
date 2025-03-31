import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';

import { tv } from '../../lib/tw-utils';

const labelVariants = tv({
  base: [
    'break-all text-small font-medium leading-none text-primary',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'invalid:text-alert'
  ]
});

const Label = forwardRef<HTMLLabelElement, Aria.LabelProps>(({ className, ...props }, ref) => (
  <Aria.Label className={labelVariants({ className })} {...props} ref={ref} />
));

Label.displayName = 'ZivoeUI.Label';

export { Label, labelVariants };
