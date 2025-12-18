-- Add unique constraint for idempotency on (gap_queue_id, attempt_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempt_log_idempotent 
ON pass_1_5_attempt_log (gap_queue_id, attempt_number);