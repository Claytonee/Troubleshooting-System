const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, s.name as school_name, s.zone as school_zone
       FROM lrs_devices l JOIN schools s ON l.school_id = s.id
       ORDER BY s.name ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const [totals] = await pool.query(`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN status = 'Offline' THEN 1 ELSE 0 END) as offline,
      SUM(CASE WHEN status = 'Error' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN status = 'Maintenance' THEN 1 ELSE 0 END) as maintenance,
      SUM(CASE WHEN sync_status = 'Behind' OR sync_status = 'Failed' THEN 1 ELSE 0 END) as sync_issues,
      SUM(COALESCE(records_pending, 0)) as total_pending
      FROM lrs_devices`);
    res.json(totals[0]);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, s.name as school_name, s.zone as school_zone
       FROM lrs_devices l JOIN schools s ON l.school_id = s.id WHERE l.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'LRS device not found' });

    const [history] = await pool.query(
      'SELECT * FROM lrs_history WHERE lrs_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );
    res.json({ ...rows[0], history });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { school_id, asset_tag, hostname, serial_number, device_model, ip_address,
      mac_address, port, connection_type, os_version, lrs_version, storage_gb, ram_gb,
      power_type, status, sync_status, notes, installed_at } = req.body;

    if (!school_id || !ip_address) return res.status(400).json({ error: 'School and IP address are required' });

    const [result] = await pool.query(
      `INSERT INTO lrs_devices (school_id, asset_tag, hostname, serial_number, device_model, ip_address,
        mac_address, port, connection_type, os_version, lrs_version, storage_gb, ram_gb,
        power_type, status, sync_status, notes, installed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [school_id, asset_tag || null, hostname || null, serial_number || null, device_model || null,
       ip_address, mac_address || null, port || 3000, connection_type || 'ethernet',
       os_version || null, lrs_version || null, storage_gb || null, ram_gb || null,
       power_type || 'adapter', status || 'Online', sync_status || 'Synced', notes || null, installed_at || null]
    );

    await pool.query(
      'INSERT INTO lrs_history (lrs_id, action, new_value, actor_name, note) VALUES (?, ?, ?, ?, ?)',
      [result.insertId, 'created', status || 'Online', req.user.full_name || req.user.username, 'LRS device added']
    );

    res.status(201).json({ id: result.insertId, message: 'LRS device added' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This school already has an LRS device assigned' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { asset_tag, hostname, serial_number, device_model, ip_address,
      mac_address, port, connection_type, os_version, lrs_version, storage_gb, ram_gb,
      power_type, status, sync_status, last_sync, records_pending, notes, installed_at } = req.body;

    const [current] = await pool.query('SELECT * FROM lrs_devices WHERE id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'LRS device not found' });
    const old = current[0];

    await pool.query(
      `UPDATE lrs_devices SET asset_tag=?, hostname=?, serial_number=?, device_model=?, ip_address=?,
        mac_address=?, port=?, connection_type=?, os_version=?, lrs_version=?, storage_gb=?, ram_gb=?,
        power_type=?, status=?, sync_status=?, last_sync=?, records_pending=?, notes=?, installed_at=?,
        updated_at=NOW() WHERE id=?`,
      [asset_tag || null, hostname || null, serial_number || null, device_model || null, ip_address || old.ip_address,
       mac_address || null, port || 3000, connection_type || 'ethernet',
       os_version || null, lrs_version || null, storage_gb || null, ram_gb || null,
       power_type || 'adapter', status || old.status, sync_status || old.sync_status,
       last_sync || old.last_sync, records_pending != null ? records_pending : old.records_pending,
       notes || null, installed_at || null, req.params.id]
    );

    if (status && status !== old.status) {
      await pool.query(
        'INSERT INTO lrs_history (lrs_id, action, old_value, new_value, actor_name) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, 'status_change', old.status, status, req.user.full_name || req.user.username]
      );
    }

    res.json({ message: 'LRS device updated' });
  } catch (err) { next(err); }
}

async function changeStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const valid = ['Online', 'Offline', 'Syncing', 'Error', 'Maintenance'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const [current] = await pool.query('SELECT * FROM lrs_devices WHERE id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'LRS device not found' });

    await pool.query('UPDATE lrs_devices SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);

    await pool.query(
      'INSERT INTO lrs_history (lrs_id, action, old_value, new_value, actor_name, note) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, 'status_change', current[0].status, status, req.user.full_name || req.user.username, note || null]
    );

    res.json({ message: `Status changed to ${status}` });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM lrs_devices WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'LRS device not found' });
    res.json({ message: 'LRS device removed' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getStats, getById, create, update, changeStatus, remove };
