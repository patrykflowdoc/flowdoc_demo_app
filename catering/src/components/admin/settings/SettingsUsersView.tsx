import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserListItem } from "@/api/client";
import { getUsers, createUser, updateUser, deleteUser } from "@/api/client";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type UserFormState = {
  username: string;
  login: string;
  password: string;
};

const emptyForm: UserFormState = {
  username: "",
  login: "",
  password: "",
};

const SettingsUsersView = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      setError("Nie udało się pobrać użytkowników.");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: UserListItem) => {
    setEditingUser(user);
    setForm({
      username: user.username ?? "",
      login: user.login,
      password: "",
    });
    setIsDialogOpen(true);
  };

  const handleChange = (field: keyof UserFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.login || (!editingUser && !form.password)) {
      setError("Login i hasło są wymagane przy tworzeniu użytkownika.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          username: form.username || undefined,
          password: form.password || undefined,
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const created = await createUser({
          login: form.login,
          password: form.password,
          username: form.username || undefined,
        });
        setUsers((prev) => [...prev, created]);
      }
      setIsDialogOpen(false);
      setForm(emptyForm);
      setEditingUser(null);
    } catch {
      setError("Nie udało się zapisać użytkownika.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserListItem) => {
    if (!window.confirm(`Na pewno usunąć użytkownika "${user.login}"?`)) return;
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      setError("Nie udało się usunąć użytkownika.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Użytkownicy</h1>
          <p className="text-sm text-muted-foreground">
            Zarządzaj kontami administratorów mających dostęp do panelu.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj użytkownika
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ładowanie użytkowników...
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
            Brak użytkowników. Dodaj pierwsze konto administratora.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Utworzono</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs">{user.login}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    {user.createdAt ? new Date(user.createdAt).toLocaleString("pl-PL") : "-"}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edytuj użytkownika" : "Dodaj użytkownika"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">Login</Label>
              <Input
                id="login"
                value={form.login}
                onChange={(e) => handleChange("login", e.target.value)}
                disabled={!!editingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nazwa wyświetlana (opcjonalnie)</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Hasło {editingUser ? "(pozostaw puste, aby nie zmieniać)" : "(wymagane)"}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsUsersView;

