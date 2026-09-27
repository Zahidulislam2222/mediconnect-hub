// Local test-server transport policy; never applied to application/provider calls.
export const networkPolicy: Readonly<{ localConnectionResetRetries: number }> = {
  localConnectionResetRetries: 1,
};
