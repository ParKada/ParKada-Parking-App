-- TC-24, TC-25, TC-26: Database Trigger for Automated OCR Validation
-- This instantly checks newly detected plates against active reservations

CREATE OR REPLACE FUNCTION validate_plate_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id uuid;
    v_clean_detected text;
BEGIN
    -- Remove all spaces/hyphens for a clean comparison
    v_clean_detected := REPLACE(UPPER(NEW.detected_plate), ' ', '');

    -- TC-26: Unclear plate reading
    -- If confidence is below 60%, skip matching and send straight to manual review
    IF NEW.confidence_score < 60.0 THEN
        NEW.validation_status := 'manual_review';
        RETURN NEW;
    END IF;

    -- Search for an active reservation at this specific parking lot
    SELECT id INTO v_reservation_id 
    FROM reservations
    WHERE status IN ('active', 'confirmed', 'reserved')
      AND lot_id = NEW.lot_id
      AND REPLACE(UPPER(plate_number), ' ', '') = v_clean_detected
    LIMIT 1;

    IF FOUND THEN
        -- TC-24: Plate Number Match
        NEW.validation_status := 'matched';
        NEW.linked_reservation_id := v_reservation_id;
        RETURN NEW;
    END IF;

    -- TC-25: Plate Number Mismatch
    -- If confidence was high but no reservation was found, it's a mismatch
    NEW.validation_status := 'mismatched';
    RETURN NEW;
END;
$$;

-- Attach trigger to plate_validation_logs
DROP TRIGGER IF EXISTS trg_validate_plate ON plate_validation_logs;
CREATE TRIGGER trg_validate_plate
BEFORE INSERT ON plate_validation_logs
FOR EACH ROW
EXECUTE FUNCTION validate_plate_on_insert();
