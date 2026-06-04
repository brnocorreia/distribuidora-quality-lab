import { OrderStatus, OrderStatusValue } from '@modules/order/domain/value-objects/order-status.vo';
import { BusinessRuleException } from '@shared/domain/exceptions';

describe('OrderStatus', () => {
  describe('create', () => {
    it('when given a valid status value, then creates an OrderStatus instance', () => {
      const status = OrderStatus.create('draft');

      expect(status.value).toBe('draft');
    });

    it('when given an invalid status value, then throws BusinessRuleException', () => {
      expect(() => OrderStatus.create('invalid' as OrderStatusValue)).toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('draft', () => {
    it('when called, then creates an OrderStatus with draft value', () => {
      const status = OrderStatus.draft();

      expect(status.value).toBe('draft');
      expect(status.isDraft()).toBe(true);
    });
  });

  describe('transitionTo', () => {
    it('when draft transitions to confirmed, then returns confirmed status', () => {
      const draft = OrderStatus.create('draft');

      const confirmed = draft.transitionTo('confirmed');

      expect(confirmed.value).toBe('confirmed');
      expect(confirmed.isConfirmed()).toBe(true);
    });

    it('when draft transitions to cancelled, then returns cancelled status', () => {
      const draft = OrderStatus.create('draft');

      const cancelled = draft.transitionTo('cancelled');

      expect(cancelled.value).toBe('cancelled');
      expect(cancelled.isCancelled()).toBe(true);
    });

    it('when confirmed transitions to in_separation, then succeeds', () => {
      const confirmed = OrderStatus.create('confirmed');

      const inSeparation = confirmed.transitionTo('in_separation');

      expect(inSeparation.value).toBe('in_separation');
    });

    it('when shipped transitions to delivered, then returns delivered status', () => {
      const shipped = OrderStatus.create('shipped');

      const delivered = shipped.transitionTo('delivered');

      expect(delivered.value).toBe('delivered');
      expect(delivered.isDelivered()).toBe(true);
    });

    it('when delivered attempts any transition, then throws BusinessRuleException', () => {
      const delivered = OrderStatus.create('delivered');

      expect(() => delivered.transitionTo('cancelled')).toThrow(BusinessRuleException);
    });

    it('when draft attempts to transition to shipped, then throws BusinessRuleException', () => {
      const draft = OrderStatus.create('draft');

      expect(() => draft.transitionTo('shipped')).toThrow(BusinessRuleException);
    });
  });

  describe('canTransitionTo', () => {
    it('when draft checks confirmed, then returns true', () => {
      const draft = OrderStatus.create('draft');

      expect(draft.canTransitionTo('confirmed')).toBe(true);
    });

    it('when draft checks shipped, then returns false', () => {
      const draft = OrderStatus.create('draft');

      expect(draft.canTransitionTo('shipped')).toBe(false);
    });

    it('when cancelled checks any state, then returns false', () => {
      const cancelled = OrderStatus.create('cancelled');

      expect(cancelled.canTransitionTo('draft')).toBe(false);
      expect(cancelled.canTransitionTo('confirmed')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('when in_separation, then returns shipped and cancelled', () => {
      const inSeparation = OrderStatus.create('in_separation');

      const allowed = inSeparation.getAllowedTransitions();

      expect(allowed).toEqual(expect.arrayContaining(['shipped', 'cancelled']));
      expect(allowed.length).toBe(2);
    });
  });
});
