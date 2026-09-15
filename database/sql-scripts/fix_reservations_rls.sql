-- Allow users to update their own reservations
DROP POLICY IF EXISTS "Users can update their own reservations" ON public.reservations;
CREATE POLICY "Users can update their own reservations" ON public.reservations
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Allow users to update parking_slots status to available when cancelling
DROP POLICY IF EXISTS "Users can update slot status" ON public.parking_slots;
CREATE POLICY "Users can update slot status" ON public.parking_slots
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT slot_id FROM public.reservations WHERE profile_id = auth.uid())
);
