"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  useDevelopers,
  useCreateDeveloper,
  useUpdateDeveloper,
  useDeleteDeveloper,
  useAllAccuracies,
} from "@/hooks/use-developers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccuracyCell } from "@/components/developers/accuracy-cell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DevelopersPage() {
  const { data: developers, isLoading } = useDevelopers();
  const { data: accuracies } = useAllAccuracies();
  const createDeveloper = useCreateDeveloper();
  const updateDeveloper = useUpdateDeveloper();
  const deleteDeveloper = useDeleteDeveloper();

  const accuracyByDev = new Map(
    (accuracies ?? []).map((a) => [a.developerId, a])
  );

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [meetings, setMeetings] = useState("0");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editMeetings, setEditMeetings] = useState("0");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createDeveloper.mutateAsync({
        name,
        weeklyCapacityHours: parseFloat(capacity),
        meetingHoursPerWeek: parseFloat(meetings || "0"),
      });
      toast.success("Developer added");
      setName("");
      setCapacity("");
      setMeetings("0");
      setAddOpen(false);
    } catch {
      toast.error("Failed to add developer");
    }
  }

  function openEdit(dev: {
    id: string;
    name: string;
    weeklyCapacityHours: number;
    meetingHoursPerWeek?: number;
  }) {
    setEditId(dev.id);
    setEditName(dev.name);
    setEditCapacity(String(dev.weeklyCapacityHours));
    setEditMeetings(String(dev.meetingHoursPerWeek ?? 0));
    setEditOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateDeveloper.mutateAsync({
        id: editId,
        name: editName,
        weeklyCapacityHours: parseFloat(editCapacity),
        meetingHoursPerWeek: parseFloat(editMeetings || "0"),
      });
      toast.success("Developer updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update developer");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this developer?")) return;
    try {
      await deleteDeveloper.mutateAsync(id);
      toast.success("Developer deleted");
    } catch {
      toast.error("Failed to delete developer");
    }
  }

  return (
    <>
      <Header title="Developers" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              Manage developers and their weekly capacity
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" data-icon="inline-start" />
              Add Developer
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Developer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dev-name">Name</Label>
                  <Input
                    id="dev-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Developer name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dev-capacity">
                    Weekly Capacity (hours)
                  </Label>
                  <Input
                    id="dev-capacity"
                    type="number"
                    min="1"
                    step="0.5"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="40"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dev-meetings">
                    Average Meeting Hours / Week
                  </Label>
                  <Input
                    id="dev-meetings"
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={meetings}
                    onChange={(e) => setMeetings(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Subtracted from weekly hours before capacity is computed.
                  </p>
                </div>
                <Button type="submit" disabled={createDeveloper.isPending}>
                  {createDeveloper.isPending ? "Adding..." : "Add Developer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : developers && developers.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">
                    Weekly Capacity
                  </TableHead>
                  <TableHead className="text-right">
                    Meetings/wk
                  </TableHead>
                  <TableHead className="text-right">
                    Estimation Factor
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {developers.map((dev) => (
                  <TableRow key={dev.id}>
                    <TableCell className="font-medium">{dev.name}</TableCell>
                    <TableCell className="text-right">
                      {dev.weeklyCapacityHours}h / week
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {dev.meetingHoursPerWeek
                        ? `${dev.meetingHoursPerWeek}h`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AccuracyCell accuracy={accuracyByDev.get(dev.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(dev)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(dev.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No developers yet. Add one to start assigning tasks.
          </p>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Developer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-dev-name">Name</Label>
                <Input
                  id="edit-dev-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-dev-capacity">
                  Weekly Capacity (hours)
                </Label>
                <Input
                  id="edit-dev-capacity"
                  type="number"
                  min="1"
                  step="0.5"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-dev-meetings">
                  Average Meeting Hours / Week
                </Label>
                <Input
                  id="edit-dev-meetings"
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={editMeetings}
                  onChange={(e) => setEditMeetings(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={updateDeveloper.isPending}>
                {updateDeveloper.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
