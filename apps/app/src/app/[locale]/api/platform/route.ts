import { NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/localDb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const db = getDb();

    if (action === "getMembers") {
      return NextResponse.json({ members: db.members });
    }

    if (action === "getKeys") {
      return NextResponse.json({ keys: db.apiKeys });
    }

    if (action === "getAudits") {
      return NextResponse.json({ audits: db.audits });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to query platform database" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, email, role, name, id } = await req.json();
    const db = getDb();

    if (action === "inviteMember") {
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      const exists = db.members.some((m) => m.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return NextResponse.json({ error: "User is already a member or invited" }, { status: 400 });
      }

      const newMember = {
        _id: "mem_" + Date.now(),
        workspaceId: "dev-workspace",
        email: email.toLowerCase(),
        role: role || "member",
      };
      db.members.push(newMember);
      
      // Log audit
      db.audits.unshift({
        _id: "act_" + Date.now(),
        action: `Member invited: ${email}`,
        at: Date.now(),
      });

      saveDb(db);
      return NextResponse.json({ success: true, member: newMember });
    }

    if (action === "createKey") {
      if (!name) {
        return NextResponse.json({ error: "Key name is required" }, { status: 400 });
      }
      const randomValue = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const newKey = {
        _id: "key_" + Date.now(),
        workspaceId: "dev-workspace",
        name,
        key: `osk_live_${randomValue}`,
        createdAt: Date.now(),
      };
      db.apiKeys.push(newKey);

      // Log audit
      db.audits.unshift({
        _id: "act_" + Date.now(),
        action: `API key created: ${name}`,
        at: Date.now(),
      });

      saveDb(db);
      return NextResponse.json({ success: true, apiKey: newKey });
    }

    if (action === "deleteKey") {
      if (!id) {
        return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
      }
      const keyObj = db.apiKeys.find((k) => k._id === id);
      db.apiKeys = db.apiKeys.filter((k) => k._id !== id);

      if (keyObj) {
        // Log audit
        db.audits.unshift({
          _id: "act_" + Date.now(),
          action: `API key deleted: ${keyObj.name}`,
          at: Date.now(),
        });
      }

      saveDb(db);
      return NextResponse.json({ success: true });
    }

    if (action === "deleteMember") {
      if (!id) {
        return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
      }
      const memObj = db.members.find((m) => m._id === id);
      db.members = db.members.filter((m) => m._id !== id);

      if (memObj) {
        // Log audit
        db.audits.unshift({
          _id: "act_" + Date.now(),
          action: `Member removed: ${memObj.email}`,
          at: Date.now(),
        });
      }

      saveDb(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to mutate platform database" }, { status: 500 });
  }
}
