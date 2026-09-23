import type { CSSProperties } from "react";
import { NumberField, NumberFieldGroup, NumberFieldInput } from "./ui/number-field";
/** Null is the editable empty state; callers decide when a value is required. */
export default function NumericField({value,onValueChange,min,max,step,required,disabled,id,placeholder,className,style,'aria-label':label}:{value:number|null;onValueChange:(value:number|null)=>void;min?:number;max?:number;step?:number;required?:boolean;disabled?:boolean;id?:string;placeholder?:string;className?:string;style?:CSSProperties;'aria-label'?:string}) {
 return <NumberField id={id} value={value} onValueChange={onValueChange} min={min} max={max} step={step??'any'} required={required} disabled={disabled} className={className} style={style}>
  <NumberFieldGroup><NumberFieldInput aria-label={label} placeholder={placeholder}/></NumberFieldGroup>
 </NumberField>;
}
