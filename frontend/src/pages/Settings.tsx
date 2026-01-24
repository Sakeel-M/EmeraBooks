import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { database } from "@/lib/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Trash2, Save, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState({ currency: "USD", exportFormat: "csv" });
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      const prefs = await database.getPreferences();
      if (prefs) {
        setPreferences({
          currency: prefs.preferred_currency,
          exportFormat: "csv",
        });
      }
      setLoading(false);
    };
    loadPreferences();
  }, []);

  const savePreferences = async () => {
    await database.savePreferences({
      preferred_currency: preferences.currency,
    });
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const clearAllData = async () => {
    // Clear all files from database
    const files = await database.getAllFiles();
    for (const file of files) {
      await database.deleteFile(file.id);
    }
    
    // Clear current file reference
    localStorage.removeItem("currentFileId");
    
    setShowClearDialog(false);
    toast({
      title: "Data Cleared",
      description: "All your data has been removed.",
    });
    window.location.href = "/";
  };

  const currencies = ["USD", "EUR", "GBP", "AED", "INR", "CAD", "AUD"];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xl font-medium text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your preferences and application settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              General Preferences
            </CardTitle>
            <CardDescription>Configure your default settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="currency">Preferred Currency</Label>
              <Select
                value={preferences.currency}
                onValueChange={(value) => setPreferences({ ...preferences, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr} value={curr}>
                      {curr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4">
              <Button onClick={savePreferences}>
                <Save className="w-4 h-4 mr-2" />
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Management
            </CardTitle>
            <CardDescription>Manage your stored data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete all uploaded files, analysis data, budgets, and preferences from
                the database.
              </p>
              <Button variant="destructive" onClick={() => setShowClearDialog(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>Application information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Endpoint</span>
              <span className="font-mono text-xs">http://127.0.0.1:5000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Supported Banks</span>
              <span className="font-medium">Global</span>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear All Data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all your uploaded files, analysis data, budgets, and preferences.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearAllData}>Clear Everything</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Settings;
