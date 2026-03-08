"""Control settings routes."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import require_client_access
from models.base import db
from models.tier4 import ControlSetting

control_settings_bp = Blueprint("control_settings", __name__, url_prefix="/api")


@control_settings_bp.route("/clients/<client_id>/settings/<setting_key>", methods=["GET"])
@require_auth
@require_client_access
def get_setting(client_id, setting_key):
    setting = (
        ControlSetting.query
        .filter_by(client_id=uuid.UUID(client_id), setting_key=setting_key)
        .first()
    )
    if not setting:
        return jsonify(None)
    return jsonify(setting.to_dict())


@control_settings_bp.route("/clients/<client_id>/settings/<setting_key>", methods=["PUT"])
@require_auth
@require_client_access
def set_setting(client_id, setting_key):
    data = request.get_json()
    cid = uuid.UUID(client_id)

    setting = (
        ControlSetting.query
        .filter_by(client_id=cid, setting_key=setting_key)
        .first()
    )

    if setting:
        setting.setting_value = data.get("setting_value", {})
        setting.updated_by = uuid.UUID(g.user_id)
        setting.updated_at = datetime.now(timezone.utc)
    else:
        setting = ControlSetting(
            client_id=cid,
            setting_key=setting_key,
            setting_value=data.get("setting_value", {}),
            updated_by=uuid.UUID(g.user_id),
        )
        db.session.add(setting)

    db.session.commit()
    return jsonify(setting.to_dict())
