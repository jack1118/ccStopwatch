import '@testing-library/jest-dom'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

// jsdom 跑不完 Ionic overlay 的呈現流程（卸載後才 present → framework delegate is missing）
// → IonModal 換成同步渲染的 dialog 容器：開著才渲染內容
vi.mock('@ionic/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@ionic/react')>()
  const IonModal = ({ isOpen, className, children, ...rest }: { isOpen?: boolean; className?: string; children?: ReactNode; 'aria-label'?: string }) =>
    isOpen ? createElement('div', { role: 'dialog', className, 'aria-label': rest['aria-label'] }, children) : null
  return { ...mod, IonModal }
})
