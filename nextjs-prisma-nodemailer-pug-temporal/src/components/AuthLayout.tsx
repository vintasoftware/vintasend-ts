import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

export function AuthLayout({ 
  children, 
  title 
}: { 
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-1 lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center font-semibold tracking-tight">
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
