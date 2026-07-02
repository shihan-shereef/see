import fs from "node:fs";
import path from "node:path";

const DB_FILE = path.join(process.cwd(), "db.json");

interface DbData {
  users: any[];
  workspaces: any[];
  members: any[];
  apiKeys: any[];
  jobs: any[];
  audits: any[];
}

function initDb(): DbData {
  if (!fs.existsSync(DB_FILE)) {
    const defaultDb: DbData = {
      users: [
        {
          email: "shihanshereef2@gmail.com",
          password: "Shi@2004",
          name: "Shihan Shereef",
          avatarUrl: "",
        },
      ],
      workspaces: [
        {
          _id: "dev-workspace",
          name: "Ollagraphic Workspace",
        },
      ],
      members: [
        {
          _id: "mem_1",
          workspaceId: "dev-workspace",
          email: "shihanshereef2@gmail.com",
          name: "Shihan Shereef",
          role: "admin",
        },
      ],
      apiKeys: [],
      jobs: [],
      audits: [
        { _id: "act_1", action: "Workspace created", at: Date.now() - 3600000 },
      ],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), "utf-8");
    return defaultDb;
  }
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      users: [],
      workspaces: [],
      members: [],
      apiKeys: [],
      jobs: [],
      audits: [],
    };
  }
}

export function getDb(): DbData {
  return initDb();
}

export function saveDb(data: DbData) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}
