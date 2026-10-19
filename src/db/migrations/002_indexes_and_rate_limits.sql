-- Every records page filters by user and date range, newest first.
CREATE INDEX IF NOT EXISTS idx_egg_records_user_date ON egg_records (user_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_quail_population_user_date ON quail_population (user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_purchases_user_date ON feed_purchases (user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_consumption_user_date ON feed_consumption (user_id, consumption_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales (user_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hits INT NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits (reset_at);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
