import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KeyManagement = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Encryption Key Management</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Encryption keys are now generated and managed automatically for each user session.
          Manual key configuration is no longer required.
        </p>
      </CardContent>
    </Card>
  );
};

export default KeyManagement;