import { useState, type CSSProperties } from "react";
import { CalendarIcon } from "lucide-react";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { Calendar } from "./ui/calendar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Popover, PopoverTrigger, PopoverPopup } from "./ui/popover";
import { Drawer, DrawerTrigger, DrawerPopup, DrawerHeader, DrawerTitle, DrawerPanel, DrawerFooter, DrawerClose } from "./ui/drawer";
/** Calendar values are local date-only strings. Never serialize a day through UTC. */
export function calendarDay(date:Date) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function localDate(value?:string){return value?new Date(`${value}T12:00:00`):undefined;}
export default function DateControl({value,onValueChange,min,max,required,disabled,id,className,style,'aria-label':label='Date'}:{value:string;onValueChange:(day:string)=>void;min?:string;max?:string;required?:boolean;disabled?:boolean;id?:string;className?:string;style?:CSSProperties;'aria-label'?:string}){
 const desktop=useIsDesktop();const [open,setOpen]=useState(false);
 const calendar=<Calendar mode="single" selected={localDate(value)} defaultMonth={localDate(value)} disabled={[...(min?[{before:localDate(min)!}]:[]),...(max?[{after:localDate(max)!}]:[])]} onSelect={date=>{if(date){onValueChange(calendarDay(date));setOpen(false);}}}/>;
 const trigger=<Button variant="outline" size="icon" disabled={disabled} aria-label={`Choose ${label.toLowerCase()}`}><CalendarIcon/></Button>;
 return <div className={`flex min-w-0 items-center gap-1 ${className??''}`} style={style}>
  <Input id={id} aria-label={label} type="date" value={value} min={min} max={max} required={required} disabled={disabled} onChange={e=>onValueChange(e.target.value)} className="min-w-0 flex-1"/>
  {desktop?<Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={trigger}/><PopoverPopup aria-label={label}>{calendar}</PopoverPopup></Popover>:
  <Drawer open={open} onOpenChange={setOpen}><DrawerTrigger render={trigger}/><DrawerPopup showBar><DrawerHeader><DrawerTitle>{label}</DrawerTitle></DrawerHeader><DrawerPanel className="flex justify-center">{calendar}</DrawerPanel><DrawerFooter><DrawerClose render={<Button variant="outline"/>}>Close</DrawerClose></DrawerFooter></DrawerPopup></Drawer>}
 </div>;
}
